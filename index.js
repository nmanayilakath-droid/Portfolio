import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// Fetch all projects
const projects = await fetchJSON('./lib/projects.json');

// Get only the first 3 projects
const latestProjects = projects.slice(0, 3);

// Select the container where projects will be displayed
const projectsContainer = document.querySelector('.projects');

// Render the latest projects with h2 heading level
renderProjects(latestProjects, projectsContainer, 'h2');

// Fetch GitHub data
const githubData = await fetchGitHubData('nmanayilakath-droid');

// Select the profile stats container
const profileStats = document.querySelector('#profile-stats');

// Update the HTML with GitHub data
if (profileStats) {
  profileStats.innerHTML = `
    <h2>GitHub Profile</h2>
    <dl>
      <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers:</dt><dd>${githubData.followers}</dd>
      <dt>Following:</dt><dd>${githubData.following}</dd>
    </dl>
  `;
}
