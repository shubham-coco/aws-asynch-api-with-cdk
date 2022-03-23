const https = require('https');

function postRequest(body) {
    const options = {
        hostname: 'order.delivery-dev.cocodelivery.com',
        path: '/api/v2/orders/three-pl',
        method: 'POST',
        port: 443,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {

            if (res.statusCode < 200 || res.statusCode >= 300) {
                console.log('statusCode:', res.statusCode);
                res.on('data', chunk => {
                    console.log("chunk:", JSON.parse(chunk));
                });
                return reject(new Error(res.body, 'statusCode=' + res.statusCode));
            } else {

                const response = {
                    statusCode: res.statusCode
                }
                return resolve(response);
            }

        });

        req.on('error', err => {
            reject(new Error(err));
        });

        req.write(body);
        req.end();
    });
}

exports.handler = async event => {
    try {
        let body;
        event.Records.forEach(record => {
            body = record.body;
            console.log("body:", body);
        });

        const result = await postRequest(body);
        
        console.log('result is: 👉️', result);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.log('Error is: 👉️', error);
        return {
            statusCode: 400,
            body: error.message,
        };
    }
};
  