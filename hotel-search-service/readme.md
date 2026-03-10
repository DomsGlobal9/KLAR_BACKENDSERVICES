klar-backend/
└── services/
    └── hotel-search-service/
        ├── src/
        │   ├── app.ts
        │   ├── server.ts
        │   │
        │   ├── config/
        │   │   ├── env.ts
        │   │   └── service.config.ts
        │   │
        │   ├── clients/
        │   │   └── rategain.client.ts   
        │   │
        │   ├── controllers/
        │   │   ├── destinations.controller.ts
        │   │   ├── hotels.controller.ts
        │   │   └── products.controller.ts
        │   │
        │   ├── services/
        │   │   ├── destinations.service.ts
        │   │   ├── hotels.service.ts
        │   │   └── products.service.ts
        │   │
        │   ├── providers/
        │   │   └── rategain.provider.ts
        │   │
        │   ├── mocks/
        │   │   ├── destinations.mock.json
        │   │   ├── hotels.mock.json
        │   │   └── products.mock.json
        │   │
        │   ├── routes/
        │   │   └── index.ts
        │   │
        │   ├── middlewares/
        │   │   └── error.middleware.ts
        │   │
        │   ├── dtos/
        │   │   └── hotel.dto.ts
        │   │
        │   └── utils/
        │       └── logger.ts
        │
        ├── .env
        ├── package.json
        └── tsconfig.json
