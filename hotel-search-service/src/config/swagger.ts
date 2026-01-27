import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hotel Service API',
      version: '1.0.0',
      description: 'Consolidated API documentation for Hotel Search and Booking',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Hotel Service (Consolidated)',
      },
    ],
    tags: [
      {
        name: 'Destinations',
        description: 'Endpoints for supported destinations',
      },
      {
        name: 'Hotels',
        description: 'Endpoints for hotel search and products',
      },
      {
        name: 'Booking',
        description: 'Endpoints for hotel reservations',
      },
    ],
  },
  apis: [
    './src/controllers/*.ts',
    './src/routes/*.ts',
    './src/docs/*.ts'
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
