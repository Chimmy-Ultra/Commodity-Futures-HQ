(function () {
  // Skip on mobile for performance
  var mq = window.matchMedia('(max-width: 768px)');
  if (mq.matches) return;

  var orbA = document.getElementById('orbA');
  var orbB = document.getElementById('orbB');
  var orbC = document.getElementById('orbC');
  var orbD = document.getElementById('orbD');
  if (!orbA) return;

  var mouseX = 0.5, mouseY = 0.5;
  var currentX = 0.5, currentY = 0.5;
  var rafId;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
  });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    currentX = lerp(currentX, mouseX, 0.06);
    currentY = lerp(currentY, mouseY, 0.06);

    // Background orbs drift with mouse
    orbA.style.transform = 'translate(' + (currentX * 25) + 'px,' + (currentY * 18) + 'px)';
    orbB.style.transform = 'translate(' + (currentX * -20) + 'px,' + (currentY * 12) + 'px)';
    orbC.style.transform = 'translate(' + (currentX * 18) + 'px,' + (currentY * -15) + 'px)';
    orbD.style.transform = 'translate(' + (currentX * -12) + 'px,' + (currentY * 18) + 'px)';

    rafId = requestAnimationFrame(tick);
  }

  tick();

  // Stop animation if resized to mobile
  mq.addEventListener('change', function (e) {
    if (e.matches) {
      cancelAnimationFrame(rafId);
    } else {
      tick();
    }
  });
})();
