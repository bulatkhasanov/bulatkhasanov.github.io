/**
 * Работа скрипта делится на такие этапы:
 *
 * 1. Получение данных о расстояниях между всеми точками маршрута (от каждой к каждой) - 
 * с помощью API Яндес.Карт - этим занимается класс Distance Finder 
 *
 * 2. Поиск оптимального пути и лучших альтернативных маршрутов - класс RouteOptimizer
 *
 * 3. Отображение маршрута на карте - класс RouteMapper
 */    


    // Класс, отвечающий за получение данных из API
    function DistanceFinder(points) {
        // точки маршрута
        this.points = points;
        
        // данные от API
        this.data = {};
        // количество полученных записей о точках маршрута
        this.dataItems = 0;
        // функция, которая будет вызвана, когда придут все данные
        this.onCompleteCallback = null;

        // успешно обработанные точки
        this.okayPoints = [];
        // маршруты, для которых не удалось получить ответ от Яндеса
        this.failedRoutes = [];
        // точки, которые Яндекс не смог декодировать
        this.failedPoints = [];

        // максимальное количество точек на один запрос к Яндексу
        this.maxLength = 40;

        // был ли запущен таймаут для вывода сообщения об ошибке
        this.errorTimeout = 0;
    }

    DistanceFinder.prototype = {

        /**
         * Установка callback-а, который будет вызван, когда придут
         * все данные от Яндекса
         *
         */
        onComplete: function(callback) {
            this.onCompleteCallback = callback;
        },

        /**
         * Вызов коллбека - все данные пришли!
         *
         *
         */
        callOnCompleteCallback: function() {
            if (this.onCompleteCallback) {
                this.onCompleteCallback(this.data);
            }
            else {
                throw "onComlete callback hasn't been provided, it should be set explicitely via DistanceFinder.onComplete()";
            }
        },

        /**
         * Отправка запросов к Яндексу
         *
         * Нам необходимо узнать все возможные расстояния между точками маршрута,
         * т.е. от каждой до каждой точки
         */
        findDistances: function() {
            // Чтобы минимизировать число запросов к Яндексу и избежать блокировки,
            // мы хитрым образом готовим запросы
            var routes = this.prepareRoutes();

            for (var i = 0; i < routes.length; i++) {
                this.processRoute(routes[i]);
            }
            return this;
        },

        /**
         * Каждый запрос - это "маршрут" вида 0-1-0-2-0-3-0..., где
         * 0, 1, 2.. - это точки машрута. Таким образом мы узнаем расстояния
         * от 0 до 1 и назад, от 0 до 2 и назад, и т.д.
         *
         */
        prepareRoutes: function() {
            var routes = [];

            for (var i = 0; i < this.points.length - 1; i++) {
                var currentRoute = [i];

                for (var j = 0; j < this.points.length; j++) {
                    if (i < j) {
                        currentRoute.push(j);
                        currentRoute.push(i);

                        if (currentRoute.length > this.maxLength) {
                            routes.push(currentRoute);
                            currentRoute = [i];
                        }
                    }
                }

                if (currentRoute.length > 1) {
                    routes.push(currentRoute);
                }
            }
            
            
            return routes;
        },

        /**
         * Построение маршрута со строками в качестве точек маршрута по индексам
         *
         *
         */
        getPointsNames: function(route) {
            var result = [];

            for (var i = 0; i < route.length; i++) {
                result.push(this.points[route[i]]);
            }
            return result;
        },

        /**
         * Отправка запроса по одному маршруту
         *
         *
         */
        processRoute: function(route) {
            var points = this.getPointsNames(route);
            var self = this;

            ymaps.route(points, {
                mapStateAutoApply:false
            }).then(function(response) {
                var paths = response.getPaths();
                paths.each(function(path, index) {
                    var data = {length: path.getLength(), time: path.getTime()};

                    var pointAIndex = route[index];
                    var pointBIndex = route[index + 1];

                    // сохраняем расстояние между двумя точками маршрута
                    self.addPointsData(pointAIndex, pointBIndex, data);
                });

            }, function (error) {
                console.log('Возникла ошибка: ' + error.message);
                // при ошибке сохраняем данные
                self.addFailedRoute(route);
            });
        },

        /**
         * Сохранение полученных результатов
         *
         *
         */
        addPointsData: function(i, j, data) {
            this.data[i + '-' + j] = data;

            var itemsNeeded = Math.pow(this.points.length, 2) - this.points.length;
            this.dataItems++;

            this.okayPoints = this.arrayUnique(this.okayPoints.concat([i, j]));

            // Если пришли все данные - вызываем коллбек и передаем ему эти данные
            if (this.dataItems == itemsNeeded) {
                this.callOnCompleteCallback();
            }
        },

        /**
         * Добавление маршрута, по которому не удалось определить расстояния, 
         * в список неудачных запросов
         *
         */
        addFailedRoute: function(route) {
            this.failedRoutes.push(route);
            this.failedPoints = this.arrayUnique(this.arrayUnique(route).concat(this.failedPoints));

            if (!this.errorTimeout) {   // добавить таймер для вывода сообщения об ошибке
                var self = this;
                this.errorTimeout = setTimeout(function() {self.reportErrors()}, 5000);
            }
        },

        /**
         * Удалить дублирующиеся значения в массиве
         *
         *
         */
        arrayUnique: function(arr) {
            var u = {}, a = [];
            for (var i = 0; i < arr.length; ++i) {
                if (u.hasOwnProperty(arr[i])) {
                continue;
                }
                a.push(arr[i]);
                u[arr[i]] = 1;
            }
            return a;
        },

        /**
         * Вернуть разницу между двумя массивами
         *
         *
         */
        arrayDiff: function(arr1, arr2) {
            return arr1.filter(function(i) {return !(arr2.indexOf(i) > -1);});
        },

        /**
         * Сообщение об ошибке
         *
         *
         */
        reportErrors: function() {
           var errorPoints = this.arrayDiff(this.failedPoints, this.okayPoints);
        
            var errorNames = [];
            for (var i = 0; i < errorPoints.length; i++) {
                errorNames.push(this.points[errorPoints[i]]);
            }

            $('#status img').hide();
            $('#error').html('Невозможно определить расстояние до точек: <br />' + errorNames.join('<br />'));

            $('#error').after('<br /><br /><a href="">Загрузить исправленный файл</a>')
        }
    }

    /**
     * Класс, оптимизирующий маршрут
     *
     */
    function RouteOptimizer(data, options) {
        options = options || {};
        this.data = data;

        // подготовка матрицы расстояний
        this.distances = this.prepareDistances(data);

        // параметры алгоритма
        this.temperatureStart = Math.pow(10, 10);
        this.temperatureEnd = typeof options.temperatureEnd !== 'undefined' ? options.temperatureEnd : 0.00001;
        this.coolingFactor = typeof options.coolingFactor !== 'undefined' ? options.coolingFactor : 0.99;
        this.iterations = typeof options.iterations !== 'undefined' ? options.iterations : 15;

        this.optimalRoute = [];
        this.optimalDistance = Infinity;

        this.topRoutes = [];
        this.topCosts = [];
    }

    RouteOptimizer.prototype = {
        
        /**
         * Заполняет матрицу расстояний
         *
         */
        prepareDistances: function(data) {
            var result = [];

            for (key in data) {
                var index = key.split('-');

                if (typeof result[index[0]] === "undefined") {
                    result[index[0]] = [];
                }
                result[index[0]][index[1]] = data[key]['length'];
            }

            return result;
        },

        /**
         * Находит оптимальный маршрут за this.iterations итераций, выбирает из них наилучший
         *
         */
        getOptimal: function() {
            var self = this;

            var route = this.getInitialRoute();
            var cost = this.getTotalDistance(route);

            var routes = [];
            var costs = [];
            var routesHash = {};

            for (var i = 0; i < this.iterations; i++) {
                result = this.runOneIteration();

                if (result.cost < this.optimalDistance) {
                    this.optimalDistance = result.cost;
                    this.optimalRoute = result.route;
                }

                var hash = result.route.join('-');
                if (!routesHash.hasOwnProperty(hash)) {
                    routesHash[hash] = true;
                    routes.push(result.route);
                    costs.push(result.cost);
                }
            }

            this.findTopRoutes(costs, routes);
            return {'route': this.optimalRoute, 'distance': this.optimalDistance};
        },

        /**
         * Находит 5 лучших маршрутов
         *
         */
        findTopRoutes: function(costs, routes) {
            var n = 5;  
            for (var i = 0; i < n; i++) {
                min = Infinity;
                minIndex = -1;
                for (var j = 0; j < costs.length; j++) {
                    if (costs[j] < min) {
                        min = costs[j];
                        minIndex = j;
                    }
                }

                this.topCosts.push(min);
                this.topRoutes.push(routes[minIndex]);

                delete costs[minIndex];
            }
        },

        /**
         * Возвращает лучшие маршруты
         *
         */
        getTopRoutes: function() {
            return {routes: this.topRoutes, lengths: this.topCosts};
        },

        /**
         * Выполняет одну итерацию оптимизатора: находит наилучший маршрут
         * по алгоритму, описанному на 
         * http://codecapsule.com/2010/04/06/simulated-annealing-traveling-salesman/
         * 
         */
        runOneIteration: function() {
            var route = this.getInitialRoute();
            var routeNew = [];
            var cost = this.getTotalDistance(route);
            var costNew = 0;
            var difference = 0;
            
            var indices = [];
            var newRouteData = {};
            
            var temperature = this.temperatureStart;

            var routeBest = route;
            var costBest = cost;

            while (temperature > this.temperatureEnd) {
                // меняем две точки случайным образом
                indices = this.getIndicesToSwap();

                routeNew = route.slice(0);
                // вычисляем длину нового маршрута
                newRouteData = this.getNewRouteData(routeNew, indices, cost);

                routeNew = newRouteData.route;
                costNew = newRouteData.cost;

                difference = cost - costNew;

                // если он лучше старого или он хуже, но "температура" достаточно высока, так что мы 
                // можем себе позволить пробовать разные варианты - принимаем данный маршрут в 
                // качестве текущего
                if (difference > 0 || Math.exp(difference / temperature) > Math.random()) {
                    cost = costNew;
                    route = routeNew;

                    if (cost < costBest) {
                        routeBest = route;
                        costBest = cost;
                    }
                }

                // "охлаждаем" алгоритм, так что все с большей вероятностью будем идти к локальному оптимуму
                temperature *= this.coolingFactor;
            }

            return {'route': routeBest, 'cost': costBest};
        },

        /**
         * Возвращает расстояние между двумя точками
         *
         */
        getDistance: function(a, b) {
            return this.distances[a][b];
        },

        /**
         * Расчитывает полное расстояние маршрута
         *
         */
        getTotalDistance: function(route) {
            var result = 0;

            for (var i = 0; i < route.length - 1; i++) {
                result += this.getDistance(route[i], route[i + 1]);
            }
            return result;
        },

        /**
         * Предлагает начальный маршрут случайным образом
         *
         */
        getInitialRoute: function() {
            var points = [];

            for (var i = 0; i < this.distances.length; i++) {
                points[i] = i;
            }

            // 0 индекс никогда не меняет своей позиции - перемешываются только остальные
            points = [points[0]].concat(this.shuffleArray(points.slice(1)));

            return points;
        },

        /**
         * Возвращает пару индексов - точки маршрута, которые меняются местами друг с другом
         *
         */
        getIndicesToSwap: function() {
            var i = this.getRandomIndexToSwap(),
                j = 0;

            do {
                j = this.getRandomIndexToSwap();

            } while (j == i);

            return [i, j];
        },

        /**
         * Возвращает новый маршрут после перестановки двух точек и его расстояние
         * Чтобы не пересчитывать полное расстояние каждый раз, пересчитываем
         * только изменившееся части маршрута
         */
        getNewRouteData: function(route, indices, cost) {
            // before swap
            var paths = this.findPathsAffectedBySwap(indices, route.length);
            cost = this.calculateCostOnSwap(route, cost, paths, false);

            var swap = route[indices[0]];
            route[indices[0]] = route[indices[1]];
            route[indices[1]] = swap;

            // after swap
            cost = this.calculateCostOnSwap(route, cost, paths, true);
            return {route: route, cost: cost};
        },

        /**
         * Находит участки пути, которые изменяются из-за перестановки двух точек
         *
         */
        findPathsAffectedBySwap: function(indices, length) {
            var result = [];
            var hash = {};
            
            for (var k = 0; k < 2; ++k) {
                var i = indices[k];
                var j = i - 1;
                if (j >= 0) {
                    hash[j + '-' + i] = true;
                }

                j = i + 1;
                if (j < length) {
                    hash[i + '-' + j] = true;
                }
            }

            for (key in hash) {
                result.push(key.split('-'));
            }
            return result;
        },

        /**
         * Считает изменение общего расстояния при перестановке двух точек маршрута
         *
         */
        calculateCostOnSwap: function(route, cost, paths, plus) {
            var plus = plus || false;
            var sign = plus ? 1 : -1;
            for (var k = 0; k < paths.length; ++k) {
                var i = route[paths[k][0]];
                var j = route[paths[k][1]];
                cost = cost + sign * this.getDistance(i, j);
            }
            return cost;
        },

        /**
         * Возвращает случайный индекс(от 1 до максимального)
         *
         */
        getRandomIndexToSwap: function() {
            return this.getRandomNumber(this.distances.length - 1) + 1;
        },

        /**
         * Возвращает случайное число 0 до n-1
         *
         */
        getRandomNumber: function (n) {
            var fraction = 1 / n;
            return Math.floor(Math.random() / fraction);
        },

        /**
         * http://dzone.com/snippets/array-shuffle-javascript
         * Перемешивает массив случайным образом
         */
        shuffleArray: function(o) {
            for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
            return o;
        }
    }


    /**
     * Класс, который отображает маршрут на карте и выводит другие результаты
     *
     *
     */
    function RouteMapper(points, times, distanceData, currentRoute, allRoutes) {
        this.points = points;
        this.times = times;
        this.distanceData = distanceData;
        this.optimal = currentRoute;
        this.routes = allRoutes;

        this.map = new ymaps.Map("map", {
            center:[57.931311, 34.576128],
            zoom:6
        });

        var trafficControl = new ymaps.control.TrafficControl({shown: false});
        this.map.controls.add(trafficControl, {top: 10, right: 10});    // добавление возможности показывать пробки
        this.map.controls.add('zoomControl', { top: 10, left: 10});  // добавление управления масштабами

        this.displayedRoute = null;
    }

    RouteMapper.prototype = {

        /** 
         * Отобразить маршрут на карте
         *
         *
         */
        mapRoute: function(routeNum) {
            routeNum = routeNum || 0;

            currentRoute = this.getRoute(this.routes.routes[routeNum]);

            var self = this;

            $('#status').hide();
            ymaps.route(currentRoute.names, {
                mapStateAutoApply:true
            }).then(function (route) {
                if (self.displayedRoute) {
                    self.map.geoObjects.remove(self.displayedRoute);
                }
                self.map.geoObjects.add(route);
                self.displayedRoute = route;

                // output
                var lines = [];
                var totalTime = 0;
                var totalLength = 0;

                for (var k = 1; k < currentRoute.ids.length; k++) {
                    var i = currentRoute.ids[k - 1];
                    var j = currentRoute.ids[k];

                    var key = i + '-' + j;
                    var stopTime = self.times[j] * 60;
                    lines.push("<b>" + currentRoute['names'][k - 1] + " - " + currentRoute['names'][k] + "</b>: " + 
                        self.getHumanLength(self.distanceData[key]['length']) + ", " +
                        self.getHumanTime(self.distanceData[key]['time']) + " + остановка " +
                        self.getHumanTime(stopTime));

                    totalTime += self.distanceData[key]['time'] + stopTime;
                    totalLength += self.distanceData[key]['length'];
                }

                var $total = $('#route h3');
                $total.html("Полный маршрут: " + self.getHumanLength(totalLength) + ", " + self.getHumanTime(totalTime));

                var $routeAlternate = $('#route a');
                $routeAlternate.show();

                var $list = $('#route ol.list');
                $list.html('');
                
                for (var i = 0; i < lines.length; i++) {
                    $list.append('<li>' + lines[i] + '</li>');
                }

                var $alternate = $('#alternate ol');
                $alternate.html('');

                for (var i = 0; i < self.routes.routes.length; i++) {
                    $alternate.append('<li><a class="js' + (i == routeNum ? ' current' : '') + '" onclick="Mapper.mapRoute(' + i + ');">' + self.getHumanLength(self.routes.lengths[i]) + '</a></li>');
                }
            }, function (error) {
                alert('Возникла ошибка: ' + error.message);
                console.log(error);
            });
        },

        /**
         * Получение данных о маршруте
         *
         *
         */
        getRoute: function(route) {
            var result = {ids: [], names: []};

            for (var i = 0; i < route.length; i++) {
                result['ids'].push(route[i]);
                result['names'].push(this.points[route[i]]);
            }
            return result;
        },

        /**
         * Вернуть время в человекочитаемом формате :)
         *
         *
         */
        getHumanTime: function(seconds) {
            var hours = seconds / 3600;
            var minutes = Math.round((seconds % 3600) / 60);
            hours = Math.floor(hours);
            var result = '';

            if (hours) {
                result = hours + " ч. ";
            }
            return result + minutes + " мин.";
        },

        /**
         * Вернуть расстояние в человеческом формате :)
         *
         *
         */
        getHumanLength: function(meters) {
            return (meters / 1000).toFixed(1) + " км.";
        }
    }
