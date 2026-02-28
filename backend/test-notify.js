const fs = require('fs');
fetch('http://localhost:3000/api/guests/notify', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_TOKEN || ''}` // Will fail cleanly if no token, just checking if the route parses
    },
    body: JSON.stringify({
        guestIds: [1],
        message: 'This is a test image payload',
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    })
}).then(r => r.json()).then(console.log).catch(console.error);
