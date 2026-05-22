FROM python:3.12-slim

RUN apt-get update && apt-get install -y procps dmidecode && apt-get clean

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt --quiet

COPY . .

CMD ["python3", "main.py"]