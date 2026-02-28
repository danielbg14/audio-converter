FROM node:18-bullseye

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json .
# Install production dependencies inside the image
RUN npm install --production

COPY src ./src

RUN mkdir -p /usr/src/app/uploads /usr/src/app/outputs

# backend listens on 3001 after port swap
EXPOSE 3001

CMD ["node", "src/index.js"]
