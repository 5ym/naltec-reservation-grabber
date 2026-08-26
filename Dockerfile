FROM oven/bun:1.4

# Bun.WebView (chrome バックエンド) が使う Chromium と日本語フォント
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

ENV BUN_CHROME_PATH=/usr/bin/chromium
ENV RUNNING_IN_DOCKER=1

WORKDIR /app
COPY package.json bun.lock tsconfig.json index.ts ./
RUN bun install --frozen-lockfile

CMD ["bun", "run", "index.ts"]
