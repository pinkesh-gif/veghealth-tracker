fetch('/api/gemini', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'say hello'})}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))
