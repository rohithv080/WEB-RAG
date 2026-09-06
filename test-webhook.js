fetch("https://web-rag-two.vercel.app/api/telegram", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: {
      chat: { id: 123456 },
      text: "Pasta"
    }
  })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
