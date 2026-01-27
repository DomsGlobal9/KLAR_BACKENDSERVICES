import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hotel Booking Service API',
            version: '1.0.0',
            description: 'API documentation for the Hotel Booking Service',
        },
        servers: [
            {
                url: 'http://localhost:5002',
                description: 'Development server',
            },
        ],
    },
    apis: [
        './src/controllers/*.ts',
        './src/routes/*.ts'
    ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
