import requests
import json
url = "https://ac.finance.naver.com/ac?q=현대차&q_enc=utf-8&st=111&r_format=json&r_enc=utf-8"
res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
print(json.dumps(res.json(), ensure_ascii=False, indent=2))
