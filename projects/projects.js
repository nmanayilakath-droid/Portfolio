import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');

let query = '';
let selectedYear = null;

function normalizeQuery(value) {
  return value.trim().toLowerCase();
}

function matchesQuery(project, queryValue) {
  if (!queryValue) return true;
  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(queryValue);
}

function getFilteredProjects() {
  return projects
    .filter((project) => matchesQuery(project, normalizeQuery(query)))
    .filter((project) => (selectedYear ? project.year === selectedYear : true));
}

function updateProjectsCount(filteredProjects) {
  if (projectsTitle) {
    projectsTitle.textContent = `Projects (${filteredProjects.length})`;
  }
}

function renderPieChart(projectsGiven) {
  const filteredProjects = projectsGiven;

  if (!filteredProjects || filteredProjects.length === 0) {
    svg.selectAll('*').remove();
    legend.selectAll('*').remove();
    return;
  }

  const rolledData = d3
    .rollups(filteredProjects, (v) => v.length, (d) => d.year)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const data = rolledData.map(([year, count]) => ({ label: year, value: count }));

  const colors = d3.scaleOrdinal(d3.schemeTableau10);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcs = sliceGenerator(data);

  svg.selectAll('path').data(arcs).join(
    (enter) =>
      enter
        .append('path')
        .attr('d', arcGenerator)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('cursor', 'pointer')
        .attr('fill', (_, i) => colors(i))
        .classed('selected', (d) => d.data.label === selectedYear)
        .on('click', (_, d) => {
          selectedYear = selectedYear === d.data.label ? null : d.data.label;
          updateView();
        }),
    (update) =>
      update
        .attr('d', arcGenerator)
        .attr('fill', (_, i) => colors(i))
        .classed('selected', (d) => d.data.label === selectedYear),
    (exit) => exit.remove()
  );

  legend
    .selectAll('li')
    .data(data)
    .join(
      (enter) =>
        enter
          .append('li')
          .attr('class', 'legend-item')
          .attr('style', (_, i) => `--color:${colors(i)}`)
          .html((d) => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
          .on('click', (_, d) => {
            selectedYear = selectedYear === d.label ? null : d.label;
            updateView();
          }),
      (update) =>
        update
          .attr('style', (_, i) => `--color:${colors(i)}`)
          .classed('selected', (d) => d.label === selectedYear),
      (exit) => exit.remove()
    )
    .classed('selected', (d) => d.label === selectedYear);
}

function updateView() {
  const filteredProjects = getFilteredProjects();
  updateProjectsCount(filteredProjects);
  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
}

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    query = event.target.value;
    updateView();
  });
}

updateView();
