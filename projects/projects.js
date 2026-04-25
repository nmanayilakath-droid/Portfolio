import { fetchJSON, renderProjects } from '../global.js';

// Fetch project data from JSON file
const projects = await fetchJSON('../lib/projects.json');

// Select the container where projects will be rendered
const projectsContainer = document.querySelector('.projects');

// Render the projects with h2 heading level
renderProjects(projects, projectsContainer, 'h2');

// Display project count
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  projectsTitle.textContent = `Projects (${projects.length})`;
}
