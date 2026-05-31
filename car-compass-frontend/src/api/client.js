const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const getRecommendations = (payload) =>
  fetch(`${BASE_URL}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

export const getExplanation = (payload) =>
  fetch(`${BASE_URL}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

export const getWhyNot = (payload) =>
  fetch(`${BASE_URL}/why-not`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
