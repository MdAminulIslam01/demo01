'use strict';

const CATEGORY_OPTIONS = {
  expense: ['餐饮', '交通', '购物', '居家', '医疗', '娱乐', '教育', '其他'],
  income: ['工资', '奖金', '兼职', '理财', '其他']
};

const CURRENCY = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const state = {
  transactions: [],
  filter: 'all',
  type: 'expense',
  toastTimer: null
};

const elements = {
  balance: document.getElementById('balance-value'),
  income: document.getElementById('income-value'),
  expense: document.getElementById('expense-value'),
  list: document.getElementById('transaction-list'),
  listFooter: document.getElementById('list-footer'),
  form: document.getElementById('transaction-form'),
  typeButtons: Array.from(document.querySelectorAll('.type-option')),
  filterButtons: Array.from(document.querySelectorAll('.filter-button')),
  category: document.getElementById('category'),
  description: document.getElementById('description'),
  amount: document.getElementById('amount'),
  date: document.getElementById('date'),
  submit: document.getElementById('submit-button'),
  today: document.getElementById('today-label'),
  jumpToForm: document.getElementById('jump-to-form'),
  toast: document.getElementById('toast')
};

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatMoney(cents) {
  return CURRENCY.format(cents / 100);
}

function formatDate(value) {
  const parts = value.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).format(date);
}

function setCategories(type) {
  elements.category.replaceChildren();
  for (const category of CATEGORY_OPTIONS[type]) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.category.append(option);
  }
}

function showToast(message, isError) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', Boolean(isError));
  elements.toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2600);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.error || '请求失败，请稍后再试');
  }
  return payload;
}

function visibleTransactions() {
  if (state.filter === 'all') return state.transactions;
  return state.transactions.filter((record) => record.type === state.filter);
}

function renderSummary() {
  const now = new Date();
  const month = localDateString(now).slice(0, 7);
  let allIncome = 0;
  let allExpense = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  for (const record of state.transactions) {
    if (record.type === 'income') {
      allIncome += record.amountCents;
      if (record.date.startsWith(month)) monthIncome += record.amountCents;
    } else {
      allExpense += record.amountCents;
      if (record.date.startsWith(month)) monthExpense += record.amountCents;
    }
  }

  elements.balance.textContent = formatMoney(allIncome - allExpense);
  elements.income.textContent = formatMoney(monthIncome);
  elements.expense.textContent = formatMoney(monthExpense);
}

function makeEmptyState(isFiltered) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const illustration = document.createElement('span');
  illustration.className = 'empty-illustration';
  illustration.setAttribute('aria-hidden', 'true');
  illustration.innerHTML = '<svg viewBox="0 0 32 32"><path d="M7 11.5h18v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-13Z"></path><path d="M10 11.5V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5M11 16h10M11 20h6"></path></svg>';
  wrapper.append(illustration);

  const title = document.createElement('strong');
  title.textContent = isFiltered ? '这里暂时没有符合条件的账目' : '从第一笔开始，记下生活的细节';
  wrapper.append(title);

  const description = document.createElement('span');
  description.textContent = isFiltered ? '试试切换筛选条件。' : '添加一笔收入或支出，收支情况会自动汇总。';
  wrapper.append(description);
  return wrapper;
}

function makeTransactionRow(record) {
  const row = document.createElement('article');
  row.className = 'transaction-row';

  const categoryMark = document.createElement('span');
  categoryMark.className = 'category-mark' + (record.type === 'income' ? ' is-income' : '');
  categoryMark.setAttribute('aria-hidden', 'true');
  categoryMark.textContent = record.category.slice(0, 1);
  row.append(categoryMark);

  const details = document.createElement('div');
  details.className = 'transaction-details';
  const title = document.createElement('p');
  title.className = 'transaction-title';
  title.textContent = record.description;
  const meta = document.createElement('div');
  meta.className = 'transaction-meta';
  const category = document.createElement('span');
  category.textContent = record.category;
  const separator = document.createElement('span');
  separator.className = 'transaction-meta-dot';
  separator.setAttribute('aria-hidden', 'true');
  const date = document.createElement('span');
  date.textContent = formatDate(record.date);
  meta.append(category, separator, date);
  details.append(title, meta);
  row.append(details);

  const amount = document.createElement('span');
  amount.className = 'transaction-amount' + (record.type === 'income' ? ' is-income' : '');
  amount.textContent = (record.type === 'income' ? '+' : '−') + formatMoney(record.amountCents);
  row.append(amount);

  const remove = document.createElement('button');
  remove.className = 'delete-button';
  remove.type = 'button';
  remove.setAttribute('aria-label', '删除' + record.description + '这笔账');
  remove.title = '删除这笔账';
  remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9 7V4.5h6V7m2.5 0-.8 12.5h-9.4L6.5 7m3.5 3.5v5m4-5v5"></path></svg>';
  remove.addEventListener('click', () => deleteTransaction(record));
  row.append(remove);
  return row;
}

function renderTransactions() {
  const records = visibleTransactions();
  elements.list.replaceChildren();

  if (records.length === 0) {
    elements.list.append(makeEmptyState(state.filter !== 'all' && state.transactions.length > 0));
    elements.listFooter.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const record of records) fragment.append(makeTransactionRow(record));
  elements.list.append(fragment);
  elements.listFooter.textContent = '共 ' + records.length + ' 笔记录';
  elements.listFooter.hidden = false;
}

function render() {
  renderSummary();
  renderTransactions();
}

async function loadTransactions() {
  try {
    const payload = await requestJson('/api/transactions');
    state.transactions = payload.transactions;
    render();
  } catch (error) {
    elements.list.replaceChildren();
    const empty = makeEmptyState(false);
    empty.querySelector('strong').textContent = '账目暂时无法加载';
    empty.querySelector('span:last-child').textContent = error.message;
    elements.list.append(empty);
    showToast(error.message, true);
  }
}

async function deleteTransaction(record) {
  try {
    await requestJson('/api/transactions/' + encodeURIComponent(record.id), { method: 'DELETE' });
    state.transactions = state.transactions.filter((item) => item.id !== record.id);
    render();
    showToast('已删除这笔账');
  } catch (error) {
    showToast(error.message, true);
  }
}

function setType(type) {
  state.type = type;
  for (const button of elements.typeButtons) {
    const selected = button.dataset.type === type;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  setCategories(type);
}

async function submitTransaction(event) {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;

  const savedType = state.type;
  const payload = {
    type: savedType,
    description: elements.description.value.trim(),
    amount: elements.amount.value,
    category: elements.category.value,
    date: elements.date.value
  };

  elements.submit.disabled = true;
  try {
    const result = await requestJson('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    state.transactions = [result.transaction, ...state.transactions].sort((a, b) => {
      return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    });
    elements.form.reset();
    elements.date.value = localDateString(new Date());
    setType('expense');
    render();
    showToast(savedType === 'income' ? '收入已记下' : '支出已记下');
    elements.description.focus();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.submit.disabled = false;
  }
}

function init() {
  const now = new Date();
  elements.today.textContent = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(now);
  elements.date.value = localDateString(now);
  setType('expense');

  for (const button of elements.typeButtons) {
    button.addEventListener('click', () => setType(button.dataset.type));
  }
  for (const button of elements.filterButtons) {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      for (const option of elements.filterButtons) {
        const selected = option === button;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      }
      renderTransactions();
    });
  }
  elements.form.addEventListener('submit', submitTransaction);
  elements.jumpToForm.addEventListener('click', () => {
    elements.description.focus({ preventScroll: true });
    elements.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  loadTransactions();
}

init();
