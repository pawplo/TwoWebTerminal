#!/bin/sh

file_base="icon"
file="${file_base}.png"

#if [ ! -z $1 ]; then
#  if [ ${1##*.} == "png" ]; then
#    file=$1;
#    file_base=${file%.png};
#  else
#    echo "file [$1] has not .png extension."
#    exit 1;
#  fi;
#fi;

if [ ! -f $file ]; then
  echo "file [$file] does not exists."
  exit 1;
fi

#which convert > /dev/null  2>&1;
#if [ $? -ne 0 ]; then
#  echo "[convert] program does not exists."
#  exit 1;
#fi;

for i in 128 144 152 192 256 512; do
  echo $i;
  convert -resize ${i}x${i} ${file_base}.png ${file_base}-${i}.png
done;

