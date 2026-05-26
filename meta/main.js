
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/dist/scrollama.min.js';
// --- Unit Visualization ---
function renderUnitViz(lines, { width = 600, height = 300, columns = 50 } = {}) {
  // lines: array of line objects (from all commits or filtered)
  const svg = d3.select('#unit-viz').selectAll('svg').data([null]);
  const gWidth = width, gHeight = height;
  svg.enter()
    .append('svg')
    .attr('width', gWidth)
    .attr('height', gHeight)
    .merge(svg)
    .attr('width', gWidth)
    .attr('height', gHeight);

  const unitSize = 8;
  const padding = 2;
  const n = lines.length;
  const rows = Math.ceil(n / columns);

  const unitSvg = d3.select('#unit-viz svg');
  // Stable join by line id (commit+line)
  const units = unitSvg.selectAll('rect')
    .data(lines, d => d.commit + '-' + d.line);

  // Exit
  units.exit()
    .transition().duration(400)
    .attr('width', 0)
    .attr('height', 0)
    .style('fill-opacity', 0)
    .remove();

  // Update
  units.transition().duration(400)
    .attr('x', (d, i) => (i % columns) * (unitSize + padding))
    .attr('y', (d, i) => Math.floor(i / columns) * (unitSize + padding))
    .attr('width', unitSize)
    .attr('height', unitSize)
    .attr('fill', d => d3.schemeCategory10[d.depth % 10] || '#888')
    .style('fill-opacity', 0.8);

  // Enter
  units.enter()
    .append('rect')
    .attr('x', (d, i) => (i % columns) * (unitSize + padding))
    .attr('y', (d, i) => Math.floor(i / columns) * (unitSize + padding))
    .attr('width', 0)
    .attr('height', 0)
    .attr('fill', d => d3.schemeCategory10[d.depth % 10] || '#888')
    .style('fill-opacity', 0)
    .transition().duration(400)
    .attr('width', unitSize)
    .attr('height', unitSize)
    .style('fill-opacity', 0.8);
}
// --- Scrollytelling Logic ---
function setupScrollytelling(data, commits) {
  const scroller = scrollama();
  const steps = d3.selectAll('#scrolly-text .step');

  function showStep(stepIdx) {
    // Step logic: 0 = intro, 1 = scatter, 2 = unit, 3 = filter, 4 = outro
    if (stepIdx === 0) {
      d3.select('#chart').style('opacity', 0.2);
      d3.select('#unit-viz').style('opacity', 0);
    } else if (stepIdx === 1) {
      d3.select('#chart').style('opacity', 1);
      d3.select('#unit-viz').style('opacity', 0);
      rerenderScatterPlot(currentHour);
    } else if (stepIdx === 2) {
      d3.select('#chart').style('opacity', 0.2);
      d3.select('#unit-viz').style('opacity', 1);
      // Show all lines as units
      renderUnitViz(data);
    } else if (stepIdx === 3) {
      d3.select('#chart').style('opacity', 0.2);
      d3.select('#unit-viz').style('opacity', 1);
      // Show filtered lines (by hour if slider is set)
      let filteredLines = data;
      if (currentHour !== null && currentHour !== undefined && currentHour !== 'all') {
        filteredLines = data.filter(d => Math.floor((new Date(d.datetime)).getHours()) === Number(currentHour));
      }
      renderUnitViz(filteredLines);
    } else if (stepIdx === 4) {
      d3.select('#chart').style('opacity', 0.2);
      d3.select('#unit-viz').style('opacity', 0.2);
    }
  }

  scroller
    .setup({
      step: '#scrolly-text .step',
      offset: 0.5,
      debug: false
    })
    .onStepEnter(response => {
      const idx = +d3.select(response.element).attr('data-step');
      showStep(idx);
    });

  // Initial state
  showStep(0);
}

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/nidhi/Portfolio/commit/' + commit, // Replace YOUR_REPO
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        configurable: false,
        writable: false,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // Add more stats
  const numFiles = d3.group(data, d => d.file).size;
  dl.append('dt').text('Number of files');
  dl.append('dd').text(numFiles);

  const maxFileLength = d3.max(d3.rollups(data, v => d3.max(v, d => d.line), d => d.file), d => d[1]);
  dl.append('dt').text('Maximum file length (lines)');
  dl.append('dd').text(maxFileLength);

  const avgLineLength = d3.mean(data, d => d.length);
  dl.append('dt').text('Average line length (characters)');
  dl.append('dd').text(avgLineLength.toFixed(2));

  const maxDepth = d3.max(data, d => d.depth);
  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(maxDepth);

  const avgDepth = d3.mean(data, d => d.depth);
  dl.append('dt').text('Average depth');
  dl.append('dd').text(avgDepth.toFixed(2));

  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  dl.append('dt').text('Time of day most work done');
  dl.append('dd').text(maxPeriod);

  const workByDay = d3.rollups(
    data,
    (v) => v.length,
    (d) => new Date(d.datetime).toLocaleDateString('en', { weekday: 'long' }),
  );
  const maxDay = d3.greatest(workByDay, (d) => d[1])?.[0];
  dl.append('dt').text('Day of week most work done');
  dl.append('dd').text(maxDay);
}

function renderScatterPlot(data, commits) {

  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Use a single SVG for all updates
  let svg = d3.select('#chart').select('svg');
  if (svg.empty()) {
    svg = d3
      .select('#chart')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');
  }

  // Clear axes and gridlines for update
  svg.selectAll('.axis, .gridlines').remove();

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  // Gridlines
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // Dots (stable join by commit id)
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  let dots = svg.select('g.dots');
  if (dots.empty()) {
    dots = svg.append('g').attr('class', 'dots');
  }

  // D3 stable join with key
  const circles = dots
    .selectAll('circle')
    .data(sortedCommits, d => d.id);

  // Exit
  circles.exit()
    .transition()
    .duration(400)
    .attr('r', 0)
    .style('fill-opacity', 0)
    .remove();

  // Update
  circles
    .transition()
    .duration(400)
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7);

  // Enter
  circles.enter()
    .append('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', 0)
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    })
    .transition()
    .duration(400)
    .attr('r', (d) => rScale(d.totalLines))
    .style('fill-opacity', 0.7);

  // Brush (re-attach for new data)
  svg.selectAll('.brush').remove();
  svg.call(d3.brush().on('start brush end', brushed));

  // Raise dots
  svg.selectAll('.dots, .overlay ~ *').raise();

  function brushed(event) {
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
      isCommitSelected(selection, d),
    );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  function isCommitSelected(selection, commit) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }
}

let data = await loadData();

let commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

// --- Scrollytelling and Unit Viz ---
setupScrollytelling(data, commits);

// --- Slider logic for filtering by hour ---
const slider = document.getElementById('time-slider');
const timeValue = document.getElementById('time-value');
let currentHour = null;

function updateTimeDisplay(hour) {
  if (hour === null || hour === undefined || hour === 'all') {
    timeValue.textContent = 'All';
  } else {
    timeValue.textContent = `${hour.toString().padStart(2, '0')}:00`;
  }
}

function filterCommitsByHour(hour) {
  if (hour === null || hour === undefined || hour === 'all') {
    return commits;
  }
  return commits.filter(c => Math.floor(c.hourFrac) === Number(hour));
}

function rerenderScatterPlot(hour) {
  d3.select('#chart').selectAll('*').remove();
  renderScatterPlot(data, filterCommitsByHour(hour));
}

if (slider && timeValue) {
  slider.addEventListener('input', (e) => {
    const hour = Number(e.target.value);
    currentHour = hour;
    updateTimeDisplay(hour);
    rerenderScatterPlot(hour);
  });
  // Allow for "All" option if needed
  slider.addEventListener('dblclick', () => {
    currentHour = null;
    updateTimeDisplay('all');
    rerenderScatterPlot(null);
  });
  // Initialize display
  updateTimeDisplay('all');
}