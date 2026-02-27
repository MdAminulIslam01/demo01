from langchain_classic.chains.question_answering.map_reduce_prompt import messages
from langchain_community.llms.tongyi import Tongyi
from langchain_community.chat_models.tongyi import ChatTongyi
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_core.documents import Document
from langchain_core.runnables import RunnablePassthrough
from langchain_ollama import OllamaEmbeddings
from langchain_core.output_parsers import StrOutputParser,JsonOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from torch.backends.xeon.run_cpu import format_str
from langchain_core.prompts import PromptTemplate,FewShotPromptTemplate,ChatPromptTemplate,MessagesPlaceholder
from langchain_community.document_loaders import PyPDFLoader,CSVLoader,JSONLoader,TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain.agents import create_agent
from langchain_core.tools import tool

@tool(description="查询天气")
def query_weather(city:str)->str:
    return f"{city}的天气是晴朗的"

agent = create_agent(
    model=ChatTongyi(model="qwen3-max"),
    tools=[query_weather],
    system_prompt="你是一个天气查询助手"
)

invoke = agent.stream(
    {
        "messages": [
            {"role": "user", "content": "北京的天气怎么样？"}
        ]
    },
    stream_mode="values"
)
for message in invoke:
    last=message["messages"][-1]
    print(last.content,type(last).__name__)








