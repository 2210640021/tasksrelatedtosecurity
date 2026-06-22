FROM python:3.12-alpine

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY web ./web

EXPOSE 9061

USER nobody

CMD ["gunicorn", "--bind", "0.0.0.0:9061", "web.app:app"]
