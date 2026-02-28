const http = require('http');

// Let's get a token first
const postData = JSON.stringify({
    mobile: '9876543210',
    password: 'password123'
});

const req = http.request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
}, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            const token = parsedData.token;
            console.log("Token:", token);
            
            // Now request /api/guests/unnotified
            const req2 = http.request({
                hostname: 'localhost',
                port: 5001,
                path: '/api/guests/unnotified',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }, (res2) => {
                let data2 = '';
                res2.on('data', c => data2 += c);
                res2.on('end', () => {
                    console.log("Unnotified API Response:", data2);
                });
            });
            req2.end();
            

        } catch (e) {
            console.error("Error:", e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
