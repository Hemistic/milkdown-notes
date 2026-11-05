function getDiffControlsForAddedText(added: HTMLElement) {
	let controls = added.nextElementSibling;
	if (controls?.classList.contains('milkdown-diff-added')) controls = controls.nextElementSibling;
	return controls instanceof HTMLElement && controls.classList.contains('milkdown-diff-controls')
		? controls
		: null;
}

export function installDiffReviewHoverControls(scope: HTMLElement) {
	let activeControls: HTMLElement | null = null;
	let hideTimer = 0;
	// The smoke test and the host can both wait for this before generating a diff.
	// More importantly, it makes the listener lifecycle explicit when the editor swaps notes.
	scope.dataset.mnDiffHoverReady = 'true';

	const cancelHide = () => {
		if (!hideTimer) return;
		window.clearTimeout(hideTimer);
		hideTimer = 0;
	};
	const hideControls = (controls = activeControls) => {
		if (!controls) return;
		controls.classList.remove('mn-diff-controls-visible');
		controls.style.removeProperty('left');
		controls.style.removeProperty('top');
		if (activeControls === controls) activeControls = null;
	};
	const scheduleHide = (controls: HTMLElement | null) => {
		if (!controls) return;
		cancelHide();
		hideTimer = window.setTimeout(() => {
			hideTimer = 0;
			hideControls(controls);
		}, 90);
	};
	const positionControls = (added: HTMLElement, controls: HTMLElement) => {
		controls.classList.add('mn-diff-controls-visible');
		controls.style.left = '0px';
		controls.style.top = '0px';
		const addedRect = added.getBoundingClientRect();
		const controlsRect = controls.getBoundingClientRect();
		const viewportPadding = 8;
		const gap = 6;
		const maxLeft = Math.max(viewportPadding, window.innerWidth - controlsRect.width - viewportPadding);
		const maxTop = Math.max(viewportPadding, window.innerHeight - controlsRect.height - viewportPadding);
		const canPlaceRight = addedRect.right + gap + controlsRect.width <= window.innerWidth - viewportPadding;
		const left = canPlaceRight
			? addedRect.right + gap
			: Math.min(Math.max(viewportPadding, addedRect.left), maxLeft);
		let top = canPlaceRight
			? Math.min(Math.max(viewportPadding, addedRect.top + (addedRect.height - controlsRect.height) / 2), maxTop)
			: addedRect.bottom + gap;
		if (!canPlaceRight && top + controlsRect.height > window.innerHeight - viewportPadding) {
			top = Math.max(viewportPadding, addedRect.top - controlsRect.height - gap);
		}
		controls.style.left = `${Math.round(left)}px`;
		controls.style.top = `${Math.round(top)}px`;
	};
	const revealControls = (added: HTMLElement, controls: HTMLElement) => {
		cancelHide();
		if (activeControls && activeControls !== controls) hideControls(activeControls);
		activeControls = controls;
		positionControls(added, controls);
	};
	const onMouseOver = (event: MouseEvent) => {
		const target = event.target instanceof Element ? event.target : null;
		const added = target?.closest<HTMLElement>('.milkdown-diff-added, .milkdown-diff-removed');
		if (added && scope.contains(added)) {
			const controls = getDiffControlsForAddedText(added);
			if (controls) revealControls(added, controls);
			return;
		}
		const controls = target?.closest<HTMLElement>('.milkdown-diff-controls');
		if (controls?.classList.contains('mn-diff-controls-visible')) cancelHide();
	};
	const onMouseOut = (event: MouseEvent) => {
		const target = event.target instanceof Element ? event.target : null;
		const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
		const added = target?.closest<HTMLElement>('.milkdown-diff-added, .milkdown-diff-removed');
		if (added && scope.contains(added)) {
			const controls = getDiffControlsForAddedText(added);
			if (controls && related && (added.contains(related) || controls.contains(related))) return;
			scheduleHide(controls);
			return;
		}
		const controls = target?.closest<HTMLElement>('.milkdown-diff-controls');
		if (!controls?.classList.contains('mn-diff-controls-visible')) return;
		const addedForControls = controls.previousElementSibling;
		if (related && (controls.contains(related) || addedForControls?.contains(related))) return;
		scheduleHide(controls);
	};
	const dismissOnViewportChange = () => hideControls();

	scope.addEventListener('mouseover', onMouseOver);
	scope.addEventListener('mouseout', onMouseOut);
	window.addEventListener('resize', dismissOnViewportChange);
	window.addEventListener('scroll', dismissOnViewportChange, true);
	return () => {
		cancelHide();
		hideControls();
		delete scope.dataset.mnDiffHoverReady;
		scope.removeEventListener('mouseover', onMouseOver);
		scope.removeEventListener('mouseout', onMouseOut);
		window.removeEventListener('resize', dismissOnViewportChange);
		window.removeEventListener('scroll', dismissOnViewportChange, true);
	};
}

