const query = new URLSearchParams({
  linkedin_url: "https://www.linkedin.com/in/dmoskov",
  api_key: "e9ff9dfb203ae35a64defc241704b13890c4fde1"
});
fetch(`https://api.hunter.io/v2/email-finder?${query}`).then(r => r.json()).then(console.log);
