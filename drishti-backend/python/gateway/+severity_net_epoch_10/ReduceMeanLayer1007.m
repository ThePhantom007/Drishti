classdef ReduceMeanLayer1007 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net_epoch_10.coder.ReduceMeanLayer1007';
        end
    end


    methods
        function this = ReduceMeanLayer1007(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_2_38'};
        end

        function [x_blocks_blocks_2_38] = predict(this, x_blocks_blocks_2_32)
            if isdlarray(x_blocks_blocks_2_32)
                x_blocks_blocks_2_32 = stripdims(x_blocks_blocks_2_32);
            end
            x_blocks_blocks_2_32NumDims = 4;
            x_blocks_blocks_2_32 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_2_32, [4 3 1 2], 4);

            [x_blocks_blocks_2_38, x_blocks_blocks_2_38NumDims] = ReduceMeanGraph1021(this, x_blocks_blocks_2_32, x_blocks_blocks_2_32NumDims, false);
            x_blocks_blocks_2_38 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_2_38, [3 4 2 1], 4);

            x_blocks_blocks_2_38 = dlarray(single(x_blocks_blocks_2_38), 'SSCB');
        end

        function [x_blocks_blocks_2_38] = forward(this, x_blocks_blocks_2_32)
            if isdlarray(x_blocks_blocks_2_32)
                x_blocks_blocks_2_32 = stripdims(x_blocks_blocks_2_32);
            end
            x_blocks_blocks_2_32NumDims = 4;
            x_blocks_blocks_2_32 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_2_32, [4 3 1 2], 4);

            [x_blocks_blocks_2_38, x_blocks_blocks_2_38NumDims] = ReduceMeanGraph1021(this, x_blocks_blocks_2_32, x_blocks_blocks_2_32NumDims, true);
            x_blocks_blocks_2_38 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_2_38, [3 4 2 1], 4);

            x_blocks_blocks_2_38 = dlarray(single(x_blocks_blocks_2_38), 'SSCB');
        end

        function [x_blocks_blocks_2_38, x_blocks_blocks_2_38NumDims1023] = ReduceMeanGraph1021(this, x_blocks_blocks_2_32, x_blocks_blocks_2_32NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_10.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1022, x_blocks_blocks_2_32NumDims);
            xMean = mean(x_blocks_blocks_2_32, dims);
            x_blocks_blocks_2_38 = xMean;
            x_blocks_blocks_2_38NumDims = x_blocks_blocks_2_32NumDims;

            % Set graph output arguments
            x_blocks_blocks_2_38NumDims1023 = x_blocks_blocks_2_38NumDims;

        end

    end

end