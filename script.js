'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGane) {
    super(coords, distance, duration);
    this.elevationGane = elevationGane;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178)
// const cycling1 = new Cycling([39, -12], 27, 95, 523)
// console.log(run1, cycling1);

//////////////////////////////////////
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  isEditing = false;
  #editingWorkout;

  constructor() {
    // Get users position
    this._getPosition();

    //Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!this.isEditing) {
        this._newWorkout.call(this, e);
      } else {
        this._submitEditedForm.call(this, e);
      }
    });

    form.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isEditing === false) {
        this._hideForm.call(this);
      }
    });

    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    containerWorkouts.addEventListener('click', e => {
      if (!this.isEditing === true && form.classList.contains('hidden')) {
        this._editWorkout.call(this, e);
      } else if (
        this.isEditing === true &&
        !form.classList.contains('hidden')
      ) {
        this._editOtherWorkout.call(this, e);
      } else if (
        !this.isEditing === true &&
        !form.classList.contains('hidden')
      ) {
        this._editAlert.call(this, e);
      }
    });
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your current position ');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    //Empty inputs
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    form.style.display = 'grid';
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  validInputs(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  }

  positiveInputs(...inputs) {
    return inputs.every(inp => inp > 0);
  }

  _newWorkout() {
    // const validInputs = (...inputs) =>
    //   inputs.every(inp => Number.isFinite(inp));

    // const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get date from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !this.validInputs(distance, duration, cadence) ||
        !this.positiveInputs(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevationGane = +inputElevation.value;
      // Check if data is valid
      if (
        !this.validInputs(distance, duration, elevationGane) ||
        !this.positiveInputs(distance, duration, elevationGane)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevationGane);
    }

    // Add new object to workout array
    this.#workouts.push(workout);
    console.log(this.#workouts);

    // Render workout map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__buttons">
        <button class="workout__edit">&#x270e;</button>
        <button class="workout__delete">&#215;</button>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃' : '🚴'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
      `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGane}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    if (e.target.classList.contains('.workout__delete')) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    let data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    data.map( (work) => {
      if (work.type === 'running') {
        const newWork = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
        newWork.date = new Date(work.date)
        newWork.id = work.id
        this.#workouts.push(newWork);
      } else if (work.type === 'cycling') {
        const newWork = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGane
        );
        newWork.date = new Date(work.date)
        newWork.id = work.id
        this.#workouts.push(newWork);
      }
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    // location.reload();
  }

  _deleteWorkout(e) {
    if (!e.target.classList.contains('workout__delete')) return;

    // Remove from workouts list
    const workoutEl = e.target.closest('.workout');
    workoutEl.remove();

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    // Remove from workouts array
    this.#workouts = this.#workouts.filter(
      work => work.coords !== workout.coords
    );

    // Remove from local storage
    this.reset();
    this._setLocalStorage();

    // Remove marker
    const marker = this.#markers.find(
      marker =>
        marker._latlng.lat === workout.coords[0] &&
        marker._latlng.lng === workout.coords[1]
    );
    this.#map.removeLayer(marker);
  }

  _editWorkout(e) {
    if (!e.target.classList.contains('workout__edit')) return;
    this.isEditing = true;

    const workoutEl = e.target.closest('.workout');

    this.#editingWorkout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    // Replace with form
    workoutEl.replaceWith(form);
    form.classList.remove('hidden');

    inputDistance.value = this.#editingWorkout.distance;
    inputDuration.value = this.#editingWorkout.duration;
    inputType.value = this.#editingWorkout.type;
    inputType.disabled = true;

    // type checking
    if (this.#editingWorkout.type === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = this.#editingWorkout.elevationGane;
    } else {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = this.#editingWorkout.cadence;
    }
  }

  _submitEditedForm() {
    this.#editingWorkout.distance = +inputDistance.value;
    this.#editingWorkout.duration = +inputDuration.value;
    this.#editingWorkout.type = inputType.value;

    if (this.#editingWorkout.type === 'cycling') {
      this.#editingWorkout.elevationGane = +inputElevation.value;

      if (
        !this.validInputs(this.#editingWorkout.distance, this.#editingWorkout.duration, this.#editingWorkout.elevationGane) ||
        !this.positiveInputs(this.#editingWorkout.distance, this.#editingWorkout.duration, this.#editingWorkout.elevationGane)
      )
        return alert('Inputs have to be positive numbers!');
    } else {
      this.#editingWorkout.cadence = +inputCadence.value;

      if (
        !this.validInputs(this.#editingWorkout.distance, this.#editingWorkout.duration, this.#editingWorkout.cadence) ||
        !this.positiveInputs(this.#editingWorkout.distance, this.#editingWorkout.duration, this.#editingWorkout.cadence)
      )
        return alert('Inputs have to be positive numbers!');
    }

    // render workout + hide form
    this._renderWorkout(this.#editingWorkout);
    document
      .querySelector('.workouts')
      .insertAdjacentElement('afterbegin', form);
    this._hideForm();

    this.reset();
    this._setLocalStorage();

    this.isEditing = false;
  }

  _editOtherWorkout(e) {
    if (!e.target.classList.contains('workout__edit')) return;
    this._submitEditedForm();
    this._editWorkout(e);
  }

  _editAlert(e) {
    if (!e.target.classList.contains('workout__edit')) return;
    alert('Please, fill in all fields');
  }
}

const app = new App();
