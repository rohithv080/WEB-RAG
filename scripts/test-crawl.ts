async function test() {
  const res = await fetch("http://localhost:3000/api/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://101cookbooks.com/" })
  });
  const data = await res.json();
  console.log(data);
}
test();
