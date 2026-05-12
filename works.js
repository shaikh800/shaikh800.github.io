const myWorks = [
  {
    title: "Modern Villa Render",
    description: "A photorealistic exterior render created in Blender 4.2 using Cycles engine.",
    image: "assets/render1.jpg", // আপনার ছবির সঠিক পাথ দিন
    tool: "Blender 4.2"
  },
  {
    title: "Structural Model",
    description: "3D visualization of a steel structure project for Civil Engineering lab.",
    image: "assets/structure1.jpg",
    tool: "AutoCAD 2025"
  }
  // নতুন কাজ যোগ করতে চাইলে এই অংশটুকু কপি করে নিচে পেস্ট করলেই হবে
];

// এই ফাংশনটি অটোমেটিক HTML-এ কার্ড তৈরি করবে
function loadWorks() {
  const container = document.getElementById('works-container');
  if(!container) return;
  
  container.innerHTML = myWorks.map(work => `
    <div class="project-card">
      <img src="${work.image}" alt="${work.title}" style="width:100%; border-radius:var(--radius); margin-bottom:15px; aspect-ratio: 16/9; object-fit: cover;">
      <h3>${work.title}</h3>
      <p>${work.description}</p>
      <div class="card-meta">${work.tool}</div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadWorks);
