const axios = require('axios');

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@flowdesk.com',
      password: 'admin123'
    });
    console.log('Login Success:', res.status, res.data);
    console.log('TEST_LOGIN_PASSED');
  } catch (err) {
    console.error('Login Failed:', err.response ? err.response.status : 'No Response', err.response ? err.response.data : err.message);
    console.log('TEST_LOGIN_FAILED');
  }
}

testLogin();
