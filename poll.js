async function poll() {
  while (true) {
    try {
      const r = await fetch("https://web-rag-two.vercel.app/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: { chat: { id: 123456 }, text: "Pasta" } })
      });
      const text = await r.text();
      if (text.includes("Internal Error")) {
        process.stdout.write(".");
      } else {
        console.log("\nGot new error response:", text);
        break;
      }
    } catch (e) {
      console.log("Network error", e.message);
    }
    await new Promise(res => setTimeout(res, 5000));
  }
}
poll();
