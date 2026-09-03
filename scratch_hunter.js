const query = new URLSearchParams({
  first_name: "Dustin",
  last_name: "Moskovitz",
  company: "Asana",
  api_key: "e9ff9dfb203ae35a64defc241704b13890c4fde1"
});
fetch(`https://api.hunter.io/v2/email-finder?${query}`).then(r => r.json()).then(console.log);
