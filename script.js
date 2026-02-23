const margin = { top: 50, right: 100, bottom: 30, left: 95 };
const cellW = 100;
const cellH = 80;
const cellPad = 0.06;
const legendW = 18;
const legendH = 220;

const monthNames = [
	"January","February","March","April","May","June",
	"July","August","September","October","November","December"
];

let showMax = true;

const tooltip = d3.select("#tooltip");

d3.csv("temperature_daily.csv").then(data => {

	// console.log("raw data loaded, total rows:", data.length);
	// console.log("first row looks like:", data[0]);

	const parseDate = d3.timeParse("%Y-%m-%d");

	data.forEach(d => {
		d.date  = parseDate(d.date);
		d.year  = d.date.getFullYear();
		d.month = d.date.getMonth() + 1;
		d.day   = d.date.getDate();
		d.max   = +d.max_temperature;
		d.min   = +d.min_temperature;
	});

	// console.log("after parsing, first row:", data[0]);

	const allYears    = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
	const last10Years = allYears.slice(-10);
	const filtered    = data.filter(d => last10Years.includes(d.year));

	// console.log("all years:", allYears);
	// console.log("last 10 years we're using:", last10Years);
	// console.log("rows after filtering:", filtered.length);

	const grouped = d3.group(filtered, d => d.year, d => d.month);

	let matrixData = [];
	grouped.forEach((monthMap, year) => {
		monthMap.forEach((days, month) => {
			matrixData.push({
				year,
				month,
				max:   d3.max(days, d => d.max),
				min:   d3.min(days, d => d.min),
				daily: days.sort((a, b) => a.day - b.day)
			});
		});
	});

	// console.log("matrix data built, total cells:", matrixData.length);
	// console.log("example:", matrixData.find(d => d.year === 2015 && d.month === 7));

	const globalMin = d3.min(matrixData, d => d.min);
	const globalMax = d3.max(matrixData, d => d.max);

	// console.log("global temp range across all data — min:", globalMin, "max:", globalMax);

	// reversed domain so hot = red/maroon, cool = blue
	const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
		.domain([globalMax, globalMin]);

	// console.log("color check — hottest temp maps to:", colorScale(globalMax), ", coolest maps to:", colorScale(globalMin));

	const svgW = margin.left + last10Years.length * (cellW + 6) + margin.right;
	const svgH = margin.top + 12 * (cellH + 6) + margin.bottom;

	// console.log("svg dimensions:", svgW, "x", svgH);

	const svg = d3.select("#chart").append("svg")
		.attr("width", svgW)
		.attr("height", svgH);

	const xScale = d3.scaleBand()
		.domain(last10Years)
		.range([margin.left, svgW - margin.right])
		.paddingInner(cellPad);

	const yScale = d3.scaleBand()
		.domain(d3.range(1, 13))
		.range([margin.top, svgH - margin.bottom])
		.paddingInner(cellPad);

	const bw = xScale.bandwidth();
	const bh = yScale.bandwidth();

	// console.log("cell bandwidth — width:", bw, "height:", bh);

	svg.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${margin.top - 6})`)
		.call(d3.axisTop(xScale).tickSize(4))
		.call(g => g.select(".domain").attr("stroke", "#555"));

	svg.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(${margin.left - 6},0)`)
		.call(d3.axisLeft(yScale).tickFormat(d => monthNames[d - 1]).tickSize(4))
		.call(g => g.select(".domain").attr("stroke", "#555"));

	const cells = svg.selectAll(".cell")
		.data(matrixData)
		.enter()
		.append("g")
		.attr("class", "cell")
		.attr("transform", d => `translate(${xScale(d.year)},${yScale(d.month)})`);

	// console.log("cells drawn:", matrixData.length);

	cells.append("rect")
		.attr("width", bw)
		.attr("height", bh)
		.attr("rx", 2)
		.attr("fill", d => colorScale(d.max))
		.on("mouseover", function(event, d) {
			d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1.5);
			const dateStr = `${d.year}-${String(d.month).padStart(2, "0")}`;
			// console.log("hovered:", dateStr, "| max:", d.max, "min:", d.min);
			tooltip.html(`Date: ${dateStr}, max: ${d.max} min: ${d.min}`).style("opacity", 1);
			let x = event.clientX + 12, y = event.clientY + 12;
			if (x + 230 > window.innerWidth) x = event.clientX - 242;
			tooltip.style("left", x + "px").style("top", y + "px");
		})
		.on("mousemove", function(event) {
			let x = event.clientX + 12, y = event.clientY + 12;
			if (x + 230 > window.innerWidth) x = event.clientX - 242;
			tooltip.style("left", x + "px").style("top", y + "px");
		})
		.on("mouseout", function() {
			d3.select(this).attr("stroke", null);
			tooltip.style("opacity", 0);
		});

	// shared Y scale across all cells so sparklines are comparable
	const sparkY = d3.scaleLinear()
		.domain([globalMin, globalMax])
		.range([bh - 6, 6]);

	cells.each(function(d) {
		const g = d3.select(this);
		const xMini = d3.scaleLinear().domain([1, d.daily.length]).range([4, bw - 4]);

		const lineMax = d3.line().x(r => xMini(r.day)).y(r => sparkY(r.max)).curve(d3.curveMonotoneX);
		const lineMin = d3.line().x(r => xMini(r.day)).y(r => sparkY(r.min)).curve(d3.curveMonotoneX);

		g.append("path").datum(d.daily).attr("d", lineMin)
			.attr("fill", "none").attr("stroke", "rgba(220,220,220,0.85)").attr("stroke-width", 1.2).attr("pointer-events", "none");

		g.append("path").datum(d.daily).attr("d", lineMax)
			.attr("fill", "none").attr("stroke", "rgba(60,180,60,0.9)").attr("stroke-width", 1.2).attr("pointer-events", "none");
	});

	// console.log("sparklines drawn for all cells");

	buildLegend(colorScale, globalMax, globalMin);

	d3.select("#toggle").on("click", () => {
		showMax = !showMax;
		// console.log("toggle clicked:", showMax ? "max" : "min");
		d3.select("#toggle").text(showMax ? "Switch to Min Temperature" : "Switch to Max Temperature");

		const newScale = d3.scaleSequential(d3.interpolateRdYlBu)
			.domain([showMax ? globalMax : d3.max(matrixData, d => d.min), globalMin]);

		cells.select("rect")
			.transition().duration(400)
			.attr("fill", d => newScale(showMax ? d.max : d.min));

		buildLegend(newScale, showMax ? globalMax : d3.max(matrixData, d => d.min), globalMin);
	});

	function buildLegend(scale, maxVal, minVal) {
		// console.log("building legend — temp range:", minVal, "to", maxVal);
		svg.selectAll(".legend-group").remove();
		svg.select("defs").remove();

		const lx = svgW - margin.right + 20;
		const ly = margin.top;

		const grad = svg.append("defs").append("linearGradient")
			.attr("id", "tempGrad")
			.attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");

		d3.range(11).forEach(i => {
			grad.append("stop")
				.attr("offset", `${i * 10}%`)
				.attr("stop-color", scale(maxVal - (i / 10) * (maxVal - minVal)));
		});

		const group = svg.append("g").attr("class", "legend-group");

		group.append("rect")
			.attr("x", lx).attr("y", ly)
			.attr("width", legendW).attr("height", legendH)
			.attr("fill", "url(#tempGrad)");

		group.append("g")
			.attr("transform", `translate(${lx + legendW},0)`)
			.call(
				d3.axisRight(d3.scaleLinear().domain([maxVal, minVal]).range([ly, ly + legendH]))
					.ticks(5).tickFormat(d => `${d} Celsius`)
			)
			.call(g => g.select(".domain").remove())
			.selectAll("text")
			.attr("fill", "#ccc")
			.attr("font-size", "10px");
	}

});