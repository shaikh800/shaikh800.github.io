const myWorks = [
  {
    title: "Blender Character/Object Project",
    description: "An ongoing detailed 3D modeling project. While still a work-in-progress, it showcases my focus on geometry and structure.",
    image: "assets/image_8d6685.jpg", // Chobiti 'assets' folder-e rekhe ei nam-ti din
    tool: "Blender 4.2"
  },
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
