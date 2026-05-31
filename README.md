# Car Compass

Car Compass is an AI-native, questionnaire-based car buying advisor built to solve a specific problem: buyers are overwhelmed by too many options and lack an easy way to decide. 

Instead of overwhelming users with endless sliders and technical filters, Car Compass uses **decision-supported search over filtering**, guiding users through a simple 6-step questionnaire and providing AI-backed explanations for why a specific car is their best match.

---

## Tech Stack & Architecture

We chose tools optimized for rapid prototyping and seamless AI integration:

- **Backend: FastAPI (Python)**
  - *Why:* Extremely fast to write, provides automatic interactive docs (Swagger UI), easy to deploy, and leverages the Python ecosystem for flawless integration with the Gemini API.
- **Frontend: React + Vite + Tailwind CSS**
  - *Why:* The absolute fastest way to scaffold a high-performance Single Page Application (SPA) with a modern, highly-customizable design system.
- **Database: JSON file (`cars.json`)**
  - *Why:* The current car dataset is static and bounded. Setting up PostgreSQL or SQLite would add unnecessary overhead for a read-only dataset that comfortably fits in memory.

---

## AI vs. Human Collaboration

Building this project was a heavy pair-programming exercise with AI tools. Here is how the labor was divided:

### What the AI tools built:
- Initial project boilerplate and scaffolding
- React UI components and Tailwind CSS styling
- Repetitive boilerplate code and basic API routing

### What I built manually:
- The core matching algorithm and priority weighting system (safety vs. mileage vs. features vs. performance)
- Overall layout design, aesthetics, and product flow decisions
- Prompt engineering for the Gemini "AI Adviser" endpoints
- Deep debugging and architectural stitching

### Where the AI got in the way:
- **Tailwind setup:** Navigating the migration and setup quirks of the new Tailwind v4 with Vite.
- **CSS conflicts:** Resolving styling clashes (like dragging clunkiness and hover states).
- **Gemini Rate Limits:** The AI suggested pre-fetching all explanations on page load, which immediately burned through API rate limits, requiring a manual pivot to lazy-loading.

---

## Future Roadmap (If I had 4 more hours)

Given a few more hours, I would implement:
1. **Rich Media:** Images of the cars for easier understanding and visual appeal.
2. **External Links:** Direct outbound links to CarDekho or official brochures for deeper research.
3. **Advanced Filters:** A dedicated fuel type filter (EV vs. Petrol vs. Diesel).
4. **Financial Tools:** An integrated EMI calculator on the results page.
5. **Growth Features:** Shareable result links so users can send their top picks to friends/family.
6. **Mobile Polish:** Enhanced responsiveness for smaller viewports and touch targets.

---

*Built with ❤️ and Gemini.*