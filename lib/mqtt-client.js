import mqtt from 'mqtt';
import { savePlateRead } from './db';

const client = mqtt.connect('mqtt://localhost:32769');

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('alpr/plate_reads');
});

client.on('message', async (topic, message) => {
  if (topic === 'alpr/plate_reads') {
    try {
      const data = JSON.parse(message.toString());
      
      // Validate required fields
      if (!data.plate_number || !data.image || !data.timestamp) {
        throw new Error('Missing required fields in ALPR data');
      }

      // Store base64 image directly in DB
      await savePlateRead({
        plateNumber: data.plate_number,
        imageData: data.image.replace(/^data:image\/jpeg;base64,/, ''), // Remove header if present
        timestamp: data.timestamp,
        vehicleDescription: data.vehicle_description || null
      });

      console.log(`Saved plate read: ${data.plate_number}`);
    } catch (error) {
      console.error('Error processing ALPR message:', error);
      console.error('Error details:', error.message);
    }
  }
});

client.on('error', (error) => {
  console.error('MQTT client error:', error);
});

client.on('reconnect', () => {
  console.log('Attempting to reconnect to MQTT broker...');
});

export default client;