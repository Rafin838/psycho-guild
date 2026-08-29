import serverless from 'serverless-http';
import { createExpressApp } from '../../server/app.js';

const app = createExpressApp();

export const handler = serverless(app);
