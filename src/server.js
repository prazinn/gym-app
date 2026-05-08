// src/server.js
const app    = require('./app');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`\n🏋️  GymTrack running at http://localhost:${PORT}`);
  console.log(`   Environment : ${config.nodeEnv}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
