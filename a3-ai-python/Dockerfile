FROM docker.m.daocloud.io/library/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN . /etc/os-release \
    && printf "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ ${VERSION_CODENAME} main contrib non-free non-free-firmware\n" > /etc/apt/sources.list \
    && printf "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ ${VERSION_CODENAME}-updates main contrib non-free non-free-firmware\n" >> /etc/apt/sources.list \
    && printf "deb https://mirrors.tuna.tsinghua.edu.cn/debian-security ${VERSION_CODENAME}-security main contrib non-free non-free-firmware\n" >> /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY knowledge_base ./knowledge_base

RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple --upgrade pip \
    && pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple .

EXPOSE 18080

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 18080"]
