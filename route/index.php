<?php

// функция, которая разбирает csv-файл. В результате получается массив с точками маршрута, и массив с длительностью остановок
function readCSV($path) {
    $result = array('points' => array(), 'times' => array());

	if (($handle = fopen($path, 'r')) !== false) {
    	while (($data = fgetcsv($handle, 0, ",", '"')) !== false) {
    		
            $items = count($data);
    		$stopKey = $items - 1;
    		if ($items > 2) {
    			$data[0] = implode(',', array_slice($data, 0, $stopKey));
    		}

            if (count($data) >= 2) {
                $result['points'][] = $data[0];
                $result['times'][] = isset($data[$stopKey]) ? (int) $data[$stopKey] : 0;
            }
    	}
    	fclose($handle);
	}

	return $result;
}

header('Content-Type: text/html; charset=utf-8');	// Установка кодировки UTF-8

$data = array();
if (!empty($_FILES['csv']['tmp_name'])) {
	$data = readCSV($_FILES['csv']['tmp_name']);
}

include(dirname(__FILE__) . '/view.php');
