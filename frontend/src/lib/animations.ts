export interface Circle {
	id: number;
	x: number;
	y: number;
	size: number;
	animationDelay: number;
	dx: number;
	dy: number;
	opacity: number;
}

export function generateRandomCircles(count: number = 12): Circle[] {
	return Array.from({ length: count }, (_, i) => ({
		id: i,
		x: Math.random() * 80 + 10, // 10-90% to avoid edges
		y: Math.random() * 80 + 10,
		size: Math.random() * 30 + 15, // 15-45px sizes for more prominence
		animationDelay: Math.random() * 6,
		dx: (Math.random() - 0.5) * 0.03, // Slightly faster movement
		dy: (Math.random() - 0.5) * 0.03,
		opacity: Math.random() * 0.3 + 0.2 // 0.2-0.5 opacity range
	}));
}

export function animateCircles(circles: Circle[]): Circle[] {
	return circles.map(circle => {
		let newX = circle.x + circle.dx;
		let newY = circle.y + circle.dy;

		// Bounce off edges with some padding
		const padding = 5;
		if (newX <= padding || newX >= 100 - padding) {
			circle.dx *= -1;
			newX = Math.max(padding, Math.min(100 - padding, newX));
		}
		if (newY <= padding || newY >= 100 - padding) {
			circle.dy *= -1;
			newY = Math.max(padding, Math.min(100 - padding, newY));
		}

		return {
			...circle,
			x: newX,
			y: newY
		};
	});
}

export interface NextEvent {
	year: number;
	quarter: number;
	displayQuarter: string;
	nextEventDate: string;
	hasPassed: boolean;
}

export function getNextEvent(): NextEvent {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth(); // 0-11

	// Determine current quarter
	let currentQuarter: number;
	if (currentMonth <= 2) currentQuarter = 1; // Jan-Mar
	else if (currentMonth <= 5) currentQuarter = 2; // Apr-Jun
	else if (currentMonth <= 8) currentQuarter = 3; // Jul-Sep
	else currentQuarter = 4; // Oct-Dec

	// Event dates (assuming events happen around the middle of each quarter)
	const eventDates = {
		1: new Date(currentYear, 1, 15), // Feb 15 (Q1)
		2: new Date(currentYear, 4, 15), // May 15 (Q2)
		3: new Date(currentYear, 7, 15), // Aug 15 (Q3)
		4: new Date(currentYear, 10, 15) // Nov 15 (Q4)
	};

	const currentQuarterEvent = eventDates[currentQuarter as keyof typeof eventDates];
	const hasCurrentQuarterPassed = now > currentQuarterEvent;

	let nextQuarter = currentQuarter;
	let nextYear = currentYear;

	if (hasCurrentQuarterPassed) {
		nextQuarter = currentQuarter === 4 ? 1 : currentQuarter + 1;
		if (nextQuarter === 1) nextYear = currentYear + 1;
	}

	const nextEventDate = eventDates[nextQuarter as keyof typeof eventDates];
	if (nextQuarter === 1) {
		nextEventDate.setFullYear(nextYear);
	}

	// Format display date (middle of the quarter)
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	const displayDate = `${nextEventDate.getDate()} ${monthNames[nextEventDate.getMonth()]}`;

	return {
		year: nextYear,
		quarter: nextQuarter,
		displayQuarter: `Q${nextQuarter}`,
		nextEventDate: displayDate,
		hasPassed: false // This will always be the next upcoming event
	};
}