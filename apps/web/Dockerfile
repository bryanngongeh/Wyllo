FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_AUTH0_DOMAIN=
ARG VITE_AUTH0_CLIENT_ID=
ARG VITE_AUTH0_AUDIENCE=
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci
COPY apps ./apps
COPY packages ./packages
RUN npm run build --workspace @wyllo/web
RUN npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/build ./apps/web/build
COPY --from=build /app/packages/domain ./packages/domain
WORKDIR /app/apps/web
USER node
EXPOSE 3000
CMD ["node", "build"]