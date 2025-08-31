
const bcrypt = require('bcrypt');

async function hashPassword(password) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  console.log('Hashed Password:', hashedPassword);
}

// Replace 'your_desired_password' with the password you want to use
hashPassword('your_desired_password');
