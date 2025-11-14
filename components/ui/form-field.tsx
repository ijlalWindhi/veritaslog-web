/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Control } from "react-hook-form";
import { z } from "zod";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";

type CustomFieldProps = {
  control: Control<z.infer<any>> | undefined;
  render: (props: { field: any }) => React.ReactNode;
  name: keyof z.infer<any>;
  label?: string;
  className?: string;
  primary?: boolean;
};

export const CustomField = ({
  control,
  render,
  name,
  label,
  className,
  primary,
}: CustomFieldProps) => {
  return (
    <FormField
      control={control}
      name={name as string}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {primary && <span className="text-red-500">*</span>}
            </FormLabel>
          )}
          <FormControl>{render({ field })}</FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
