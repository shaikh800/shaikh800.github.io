const myWorks = [
  {
    title: "Blender Project",
    description: "Detailed 3D project made in Blender.",
    image: "assets/images/image_8d6685.jpg",
    tool: "Blender 4.2"
  },
  {
    title: "New Post",
    description: "Another detailed work.",
    image: "assets/images/image_8d0160.jpg",
    tool: "Blender 4.2"
  }
];

function loadWorks() {
  const container = document.getElementById('works-container');
  if (!container) return;
  container.innerHTML = myWorks.map(work => `
    <div class="project-card">
      <img class="work-img" src="${work.image}" alt="${work.title}">
      <h3>${work.title}</h3>
      <p>${work.description}</p>
      <div class="card-meta">${work.tool}</div>
    </div>
  `).join('');
  // trigger reveal after dynamic content loads
  container.classList.add('is-visible');
}

document.addEventListener('DOMContentLoaded', loadWorks);
