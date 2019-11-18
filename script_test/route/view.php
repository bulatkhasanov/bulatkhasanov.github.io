<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Расчет оптимального маршрута с помощью API Яндекс.Карт</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>

    <?php if (!empty($data['points'])): ?>
     <!--
        Подключаем API карт 2.x
        Параметры:
          - load=package.full - полная сборка;
          - lang=ru-RU - язык русский.

         
    -->   
    <script src="http://yandex.st/jquery/1.6.4/jquery.min.js" type="text/javascript"></script>
    <script src="http://api-maps.yandex.ru/2.0/?load=package.full&lang=ru-RU"
            type="text/javascript"></script>
    <script src="source.js"
            type="text/javascript"></script>
    
    <script type="text/javascript">

        var points = <?= json_encode($data['points']); ?>;
        var times = <?= json_encode($data['times']); ?>;

        function init () {

            var Distances = new DistanceFinder(points); // объект для поиска расстояний между точками маршрута
            Distances.findDistances().onComplete(function(data) {   // функция, которая будет вызвана когда придут все данные от Яндекса

                // параметры алгоритма оптимизации
                var params = {coolingFactor: 0.99,  // лучше не менять 
                    temperatureEnd: 0.0000001,  // температура конца алгоритма, можно изменять в пределах 0.01 до 0.00000001, влияет на "упорство" в поиске локального оптимума
                    iterations: 20};    // к-во итераций, чем больше - тем с большей вероятностью найдется наилучший результат, но при этом увеличивается врема работы алгоритма. Оптимальные значения - от 10 до 20

                var Optimizer = new RouteOptimizer(data, params);
                var optimal = Optimizer.getOptimal();   // получение оптимального маршрута
                var topRoutes = Optimizer.getTopRoutes();   // лучший + альтернативные маршруты

                Mapper = new RouteMapper(points, times, data, optimal, topRoutes);
                Mapper.mapRoute();  // отображение маршрута на карте
            });
        }

        // Когда скрипт карт загрузился - запускаем программу
        ymaps.ready(init);
    </script>
    <?php endif; ?>


    <link rel="stylesheet" href="styles.css" />
</head>

<body>
    <div id="container">
        <?php if (empty($data)): ?>
            <div id="upload">
                <p>Выберите CSV-файл</p>
                <form method="post" enctype="multipart/form-data">
                    <input type="file" name="csv" />
                    <input type="submit" value="Найти оптимальный маршрут" />
                </form>
            </div>
        <?php else: ?>
            <div id="status">
                <img src="./ajax-loader.gif">
                <span id="error"></span>
            </div>

            <div id="results">
                <div id="map">
                </div>
                <div id="route">
                    <h3></h3>
                    <a class="js small fr" style="display: none" onclick="$('#alternate').toggle(); return false;">Альтернативные маршруты</a>
                    <div id="alternate">
                        <ol>
                        </ol>
                    </div>
                    <ol class="list"></ol>
                </div>

                <br />
                <br />
            </div>
        <?php endif; ?>
    </div>
</body>
</html>
