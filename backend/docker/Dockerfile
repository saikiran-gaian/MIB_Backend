# Use Node 16 alpine as parent image
FROM node:16-alpine

Maintainer durga.prasad@gaiansolutions.com

# Change the working directory on the Docker image to /app
WORKDIR /app

# Copy package.json and package-lock.json to the /app directory
COPY package.json ./

# Copy the rest of project files into this image
COPY . .

# Clear npm cache
RUN npm cache clean --force

# Install dependencies
RUN npm install --force

# Expose application port
EXPOSE 8080

# Start the application
CMD npm start
