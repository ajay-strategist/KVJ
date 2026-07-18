const bcrypt = require('bcrypt');

async function test() {
  try {
    const pass = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pass, salt);
    console.log('Hash generated:', hash);
    const match = await bcrypt.compare(pass, hash);
    console.log('Match result:', match);
    if (match) {
      console.log('BCRYPT_TEST_PASSED');
    } else {
      console.log('BCRYPT_TEST_FAILED');
    }
  } catch (err) {
    console.error('BCRYPT_TEST_ERROR:', err);
  }
}

test();
