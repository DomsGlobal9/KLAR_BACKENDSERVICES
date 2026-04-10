hotel-booking-service/
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
│   │   ├── precheck.controller.ts
│   │   ├── commit.controller.ts
│   │   └── cancel.controller.ts
│   │
│   ├── services/
│   │   ├── precheck.service.ts
│   │   ├── commit.service.ts
│   │   └── cancel.service.ts
│   │
│   ├── providers/
│   │   └── rategain.provider.ts
│   │
│   ├── mocks/
│   │   ├── precheck.mock.json
│   │   ├── commit.mock.json
│   │   └── cancel.mock.json
│   │
│   ├── routes/
│   │   └── index.ts
│   │
│   ├── middlewares/
│   │   └── error.middleware.ts
│   │
│   ├── dtos/
│   │   └── booking.dto.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── .env
├── package.json
└── tsconfig.json
