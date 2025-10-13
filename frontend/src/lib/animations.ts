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
	
	// Next event is December 9, 2025
	const nextEventDate = new Date(2025, 11, 9); // Month is 0-indexed, so 11 = December
	const hasEventPassed = now > nextEventDate;
	
	// If the December 2025 event has passed, calculate next year's Q1 event
	let eventDate: Date;
	let quarter: number;
	let year: number;
	
	if (hasEventPassed) {
		// Move to Q1 2026
		eventDate = new Date(2026, 1, 15); // Feb 15, 2026
		quarter = 1;
		year = 2026;
	} else {
		// Use December 9, 2025 event
		eventDate = nextEventDate;
		quarter = 4;
		year = 2025;
	}

	// Format display date
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	const displayDate = `${eventDate.getDate()} ${monthNames[eventDate.getMonth()]}`;

	return {
		year: year,
		quarter: quarter,
		displayQuarter: `Q${quarter}`,
		nextEventDate: displayDate,
		hasPassed: false // This will always be the next upcoming event
	};
}