import { Nation } from './Nation.js';

export interface Alliance {
  id: number;
  name: string;
  nations: Nation[];
}
