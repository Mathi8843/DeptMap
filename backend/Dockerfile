FROM python:3.11-slim

# Install system dependencies (including git for repository cloning)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose port 8000
EXPOSE 8000

# Run uvicorn server by default
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
