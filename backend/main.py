from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
import csv
import io
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

load_dotenv(dotenv_path=r"C:\Users\Lenovo\Desktop\cowrks-tool\backend\.env")

app = FastAPI(title="Cowrks Chat Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

PROMPT_TEMPLATE = """You are a business analyst. Read this ecommerce group chat and extract all important business information.

For each important item found, extract:
- Product name
- Price mentioned
- Final bid or deal price
- Tax details
- Key point or decision

Return ONLY a JSON array. No explanation. No markdown. Just raw JSON like this:
[
  {{
    "product": "product name or empty string",
    "price": "price mentioned or empty string",
    "final_bid": "final bid price or empty string",
    "tax": "tax info or empty string",
    "key_point": "the most important thing about this item"
  }}
]

Chat source: {source}

Chat conversation:
{text}
"""

def extract_items(text: str, source: str = "General"):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(text=text, source=source)}],
        max_tokens=2000
    )
    raw = response.choices[0].message.content.strip()
    try:
        start = raw.find('[')
        end = raw.rfind(']') + 1
        return json.loads(raw[start:end])
    except:
        return [{"product": "", "price": "", "final_bid": "", "tax": "", "key_point": raw}]


def send_email_notification(items_count: int, sheet_url: str, notify_emails: list):
    sender = os.environ.get("GMAIL_ADDRESS")
    password = os.environ.get("GMAIL_PASSWORD")
    
    if not sender or not password:
        return False
    
    subject = f"Cowrks Chat Analysis — {items_count} items extracted"
    body = f"""
New chat analysis completed!

Items extracted: {items_count}
Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

View results in Google Sheet:
{sheet_url}
"""
    
    try:
        msg = MIMEMultipart()
        msg['From'] = sender
        msg['Subject'] = subject
        msg['To'] = ", ".join(notify_emails)
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, notify_emails, msg.as_string())
        server.quit()
        return True
    except:
        return False


class TextInput(BaseModel):
    text: str
    source: str = "General"

class CustomInput(BaseModel):
    text: str
    question: str
    source: str = "General"

class ExportInput(BaseModel):
    text: str
    source: str = "General"
    notify_emails: list = []


@app.post("/analyse")
async def analyse_file(file: UploadFile = File(...), source: str = Form("General")):
    contents = await file.read()
    text = contents.decode("utf-8", errors="ignore")
    items = extract_items(text, source)
    return {"items": items, "count": len(items)}


@app.post("/analyse-text")
async def analyse_text(input: TextInput):
    items = extract_items(input.text, input.source)
    return {"items": items, "count": len(items)}


@app.post("/custom")
async def custom_analysis(input: CustomInput):
    prompt = f"""Answer this question about the following chat conversation.

Question: {input.question}

Chat source: {input.source}

Chat:
{input.text}

Give a clear, direct answer. Be specific with numbers and names if relevant."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000
    )
    return {"answer": response.choices[0].message.content.strip()}


@app.post("/export-to-sheets")
async def export_to_sheets(input: ExportInput):
    items = extract_items(input.text, input.source)
    
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    
    creds_json = json.loads(os.environ.get("GOOGLE_CREDENTIALS"))
    creds = Credentials.from_service_account_info(creds_json, scopes=scope)   
    gc = gspread.authorize(creds)
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    sh = gc.open_by_key(sheet_id)
    ws = sh.sheet1
    
    if ws.cell(1, 1).value != "Product":
        ws.append_row(["Product", "Price", "Final Bid", "Tax", "Key Point", "Source", "Timestamp"])
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for item in items:
        ws.append_row([
            item.get("product", ""),
            item.get("price", ""),
            item.get("final_bid", ""),
            item.get("tax", ""),
            item.get("key_point", ""),
            input.source,
            timestamp
        ])
    
    sheet_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}"
    
    if input.notify_emails:
        send_email_notification(len(items), sheet_url, input.notify_emails)
    
    return {"success": True, "rows_added": len(items), "sheet_url": sheet_url}


@app.post("/download-text")
async def download_text_csv(input: TextInput):
    items = extract_items(input.text, input.source)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["product", "price", "final_bid", "tax", "key_point"])
    writer.writeheader()
    for item in items:
        writer.writerow({
            "product": item.get("product", ""),
            "price": item.get("price", ""),
            "final_bid": item.get("final_bid", ""),
            "tax": item.get("tax", ""),
            "key_point": item.get("key_point", "")
        })
    output.seek(0)
    filename = f"cowrks_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/download")
async def download_file_csv(file: UploadFile = File(...)):
    contents = await file.read()
    text = contents.decode("utf-8", errors="ignore")
    items = extract_items(text)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["product", "price", "final_bid", "tax", "key_point"])
    writer.writeheader()
    for item in items:
        writer.writerow({
            "product": item.get("product", ""),
            "price": item.get("price", ""),
            "final_bid": item.get("final_bid", ""),
            "tax": item.get("key_point", "")
        })
    output.seek(0)
    filename = f"cowrks_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )